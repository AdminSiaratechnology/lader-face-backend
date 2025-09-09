const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');




const app = express();
app.use(helmet());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(morgan('dev'));


app.get('/', (req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);


app.use(notFound);
app.use(errorHandler);


module.exports = app;