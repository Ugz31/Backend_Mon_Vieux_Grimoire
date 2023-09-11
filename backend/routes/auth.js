const express = require('express');
const model = require('../models/thing');
// Hachage du mot de passe
const bcrypt = require('bcrypt');
// Bearer Token
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authentification');
// utilisation d'express Js
const authRoutes = express();

// POST : Hachage mtp
authRoutes.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  // Gestion des emails valide
  const EMAIL_REGEX =
    /^(([^<>()[]\.,;:\s@"]+(.[^<>()[]\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/;
  if (!EMAIL_REGEX.test(req.body.email)) return res.status(400).json({ message: 'Email incorrect.' });

  //   Variable salt pour la sécurité + hachage
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = new model.User({
    email,
    password: hashedPassword,
  });

  try {
    const savedUser = await user.save();
    return res.status(200).json(savedUser);
  } catch (error) {
    // gestion d'erreur de doublon d'émail (MongoDB)
    if (error.code === 11000 && error.keyPattern.email === 1) {
      // L'erreur est due à une adresse électronique en double
      return res.status(400).json({ message: 'Adresse électronique déjà utilisée.' });
    }
    return res.status(500).json({ error });
  }
});

// ------------------------------------------------------------------------------
// POST : Verification info d'identification
authRoutes.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Cherche l'utilisateur dans la base de données par son email et le stocker dans la viarable user
    const user = await model.User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Adresse électronique ou mot de passe incorrecte.' });
    }

    // Vérifie si le mot de passe correspond
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Adresse électronique ou mot de passe incorrecte.' });
    }

    // Génère un jeton d'authentification (Bearer Token)
    const token = jwt.sign(
      { userId: user._id }, // Les données à inclure dans le jeton
      process.env.JWT_SECRET, // Clé secrète pour la signature du jeton (fichier .env)
      { expiresIn: '24h' } // Durée de validité du jeton
    );

    return res.status(200).json({
      userId: user._id,
      token,
    });
  } catch (error) {
    return res.status(500).json({ error });
  }
});

// Utilisation du middleware pour parser le corps de la requête en JSON
authRoutes.use(express.json());

module.exports = authRoutes;
