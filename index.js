const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Твой секретный ключ (на сервере он в безопасности)
// Используем переменную окружения, чтобы не "светить" ключ в коде
const API_KEY = process.env.TWELVE_DATA_KEY;

if (!API_KEY) console.error("WARNING: TWELVE_DATA_KEY is not defined in environment variables!");

// Простейший кеш в памяти
const cache = {
    states: {},
    series: {}
};

// Прокси для статуса рынка (кеш 1 минута)
app.get('/market_state', async (req, res) => {
    const { exchange } = req.query;
    if (!exchange) return res.status(400).json({ error: 'Exchange required' });

    const now = Date.now();
    if (cache.states[exchange] && (now - cache.states[exchange].time < 60000)) {
        console.log(`[Cache] Serving state for ${exchange}`);
        return res.json(cache.states[exchange].data);
    }

    try {
        console.log(`[API] Fetching state for ${exchange}`);
        const response = await axios.get('https://api.twelvedata.com/market_state', {
            params: { exchange, apikey: API_KEY }
        });
        cache.states[exchange] = { data: response.data, time: now };
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch market state' });
    }
});

// Прокси для графиков (кеш 5 минут)
app.get('/time_series', async (req, res) => {
    const { symbol, interval, outputsize } = req.query;
    const cacheKey = `${symbol}_${interval}_${outputsize}`;

    const now = Date.now();
    if (cache.series[cacheKey] && (now - cache.series[cacheKey].time < 300000)) {
        console.log(`[Cache] Serving series for ${symbol}`);
        return res.json(cache.series[cacheKey].data);
    }

    try {
        console.log(`[API] Fetching series for ${symbol}`);
        const response = await axios.get('https://api.twelvedata.com/time_series', {
            params: { symbol, interval, outputsize, apikey: API_KEY }
        });
        cache.series[cacheKey] = { data: response.data, time: now };
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch time series' });
    }
});

// Слушаем порт
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});