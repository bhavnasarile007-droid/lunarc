const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const apiKey = process.env.GEMINI_API_KEY;
const htmlPath = path.join(__dirname, 'healthcare-chatbot.html');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function handleChat(request, response) {
  if (!apiKey) {
    sendJson(response, 503, { error: 'GEMINI_API_KEY is not configured.' });
    return;
  }

  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', async () => {
    try {
      const { message } = JSON.parse(body);
      if (!message || typeof message !== 'string') {
        sendJson(response, 400, { error: 'A message is required.' });
        return;
      }

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: 'You are Sana, a careful healthcare assistant. Give general information only, never diagnose, and advise urgent emergency services for severe symptoms. Be concise and empathetic.' }]
            },
            contents: [{ role: 'user', parts: [{ text: message }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 300 }
          })
        }
      );
      const data = await geminiResponse.json();
      if (!geminiResponse.ok) {
        sendJson(response, geminiResponse.status, { error: data.error?.message || 'Gemini request failed.' });
        return;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      sendJson(response, 200, { reply: reply || 'I could not generate a response right now.' });
    } catch (error) {
      sendJson(response, 500, { error: 'Unable to contact Gemini.' });
    }
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/chat') {
    handleChat(request, response);
    return;
  }

  if (request.method === 'GET' && (request.url === '/' || request.url === '/healthcare-chatbot.html')) {
    fs.readFile(htmlPath, (error, content) => {
      if (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Unable to load the chatbot.');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(content);
    });
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, () => {
  console.log(`Sana is running at http://localhost:${port}`);
  console.log(apiKey ? 'Gemini API key detected.' : 'Set GEMINI_API_KEY to enable Gemini replies.');
});