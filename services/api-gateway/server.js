const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'api-gateway' });
});

app.get('/', (req, res) => {
    res.send('Welcome to the Api Gateway');
});

app.listen(port, () => {
    console.log(`api-gateway running on port ${port}`);
});
