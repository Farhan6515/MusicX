const express = require('express');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const moodMap = {
  happy: 'Happy', joy: 'Happy', surprise: 'Happy', neutral: 'Chill',
  sad: 'Sad', sadness: 'Sad', angry: 'Angry', anger: 'Angry',
  fear: 'Melancholic', disgust: 'Angry', focus: 'Focus',
  no_face: 'Chill'
};

function normalizeMood(label) {
  const key = String(label || '').toLowerCase();
  return moodMap[key] || key.charAt(0).toUpperCase() + key.slice(1) || 'Chill';
}

function fallbackMood() {
  const moods = ['Happy', 'Chill', 'Romance', 'Focus', 'Melancholic'];
  return moods[Math.floor(Math.random() * moods.length)];
}

function callPythonMoodScanner(buffer, mimeType) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'mood_scan.py');
    const child = spawn(pythonPath, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Python mood scanner timed out'));
    }, 15000);

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      let result = null;
      try {
        result = stdout ? JSON.parse(stdout) : null;
      } catch (error) {
        return reject(new Error(`Invalid Python scanner response: ${stdout || stderr}`));
      }

      if (code !== 0 || result?.error) {
        return reject(new Error(result?.detail || result?.error || stderr || `Python scanner exited with code ${code}`));
      }

      resolve({
        mood: normalizeMood(result.mood),
        confidence: Number(result.confidence || 0),
        rawLabel: result.rawLabel || null,
        provider: result.provider || 'python'
      });
    });

    child.stdin.end(JSON.stringify({
      image: buffer.toString('base64'),
      mimeType: mimeType || 'image/jpeg'
    }));
  });
}

async function callHuggingFace(buffer, mimeType) {
  const token = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_FACE_MODEL || 'dima806/facial_emotions_image_detection';
  if (!token) return null;

  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': mimeType || 'image/jpeg'
    },
    body: buffer
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Emotion model failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  const predictions = Array.isArray(result?.[0]) ? result[0] : result;
  const best = Array.isArray(predictions) ? predictions.sort((a, b) => b.score - a.score)[0] : null;
  if (!best) return null;

  return {
    mood: normalizeMood(best.label),
    confidence: Number(best.score || 0),
    provider: 'huggingface',
    rawLabel: best.label
  };
}

router.post('/analyze', upload.single('face'), async (req, res) => {
  try {
    let buffer = req.file?.buffer;
    let mimeType = req.file?.mimetype;

    if (!buffer && req.body.image) {
      const match = String(req.body.image).match(/^data:(.+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], 'base64');
      }
    }

    if (!buffer) return res.status(400).json({ error: 'Upload a face image as multipart field "face" or JSON "image" data URL.' });

    let detected = null;
    try {
      detected = await callPythonMoodScanner(buffer, mimeType);
    } catch (pythonError) {
      try {
        detected = await callHuggingFace(buffer, mimeType);
      } catch (huggingFaceError) {
        detected = null;
      }
      if (!detected) {
        detected = {
          mood: fallbackMood(),
          confidence: 0,
          provider: 'fallback',
          rawLabel: null,
          warning: pythonError.message
        };
      }
    }

    res.json({
      mood: detected.mood,
      confidence: detected.confidence || 0,
      provider: detected.provider || 'fallback',
      rawLabel: detected.rawLabel || null,
      warning: detected.warning || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Mood scan failed', detail: error.message });
  }
});

module.exports = router;
