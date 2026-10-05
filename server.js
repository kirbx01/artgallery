const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const FORBIDDEN = /(^\/|\/)(\.git|\.gitignore|package(-lock)?\.json|server\.js|\.env)/i;

app.use((req, res, next) => {
  const target = decodeURIComponent(req.path);
  if (FORBIDDEN.test(target)) return res.status(404).type('text/plain').send('Not found');
  next();
});

app.use(express.static(ROOT, { dotfiles: 'ignore', index: 'index.html' }));

app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Retro MS Paint gallery on http://localhost:' + PORT);
  });
}

module.exports = app;
