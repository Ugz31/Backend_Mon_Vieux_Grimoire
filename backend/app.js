const express = require('express');
const path = require("path");
// utilisation d'express Js
const app = express();
const mongoose = require('mongoose');

require('dotenv').config();

mongoose
  .connect('mongodb+srv://Ugz31:Ugenzo82@clustermonvieuxgrimoire.pjmhjql.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })

  .then(() => console.log('Connexion à MongoDB réussie !'))
  .catch(() => console.log('Connexion à MongoDB échouée !'));

const bookRoutes = require('./routes/books');
const authRoutes = require('./routes/auth');

// Header des requetes : CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});


app.use("/images", express.static(path.join(__dirname, "images")));
app.use(bookRoutes);
app.use(authRoutes);

module.exports = app;
