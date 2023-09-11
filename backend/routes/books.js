const express = require('express');
// gestion des données formulaires multipart/form-data
const multer = require('multer');
// gestion des fichiers / Compression
const fs = require('fs');
const sharp = require('sharp');

const model = require('../models/thing');
const auth = require('../middleware/authentification');
// utilisation d'express Js
const bookRoutes = express();
// Utilisation du middleware pour parser le corps de la requête en JSON
bookRoutes.use(express.json());

const upload = multer();
const jwt = require('jsonwebtoken');
const { log } = require('console');

// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

// GET : Renvoie un tableau de tous les livres de la base de données.
bookRoutes.get('/api/books', async (req, res) => {
  try {
    const books = await model.Book.find(); // Utilise simplement Book.find() pour obtenir les livres
    res.status(200).json(books); // Renvoie les livres en tant que réponse JSON
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des livres.' });
  }
});

// ------------------------------------------------------------------------------
// GET :Renvoie un tableau des 3 livres de la base de données ayant la meilleure note moyenne.
bookRoutes.get('/api/books/bestrating', async (req, res) => {
  try {
    const topRating = await model.Book.find()
      .sort({ averageRating: -1 }) // Triez par ordre décroissant de la note moyenne
      .limit(3); // Limitez les résultats à 3 livres

    if (!topRating) {
      return res.status(404).json({ message: 'Livres non trouvés.' });
    }
    res.status(200).json(topRating);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération des livres.' });
  }
});

// ------------------------------------------------------------------------------
// GET : Renvoie le livre avec l’_id fourni.
bookRoutes.get('/api/books/:id', async (req, res) => {
  const bookId = req.params.id;
  try {
    const book = await model.Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Livre non trouvé.' });
    }
    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la récupération du livres.' });
  }
});

// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

// POST : Capture et enregistre l'image, analyse le livre transformé en chaîne de caractères, et l'enregistre dans la base de données en définissant correctement son ImageUrl.
bookRoutes.post('/api/books', auth, upload.single('image'), async (req, res) => {
  // Récupérez les données du livre et l'image
  const { title, author, year, genre, ratings, averageRating } = JSON.parse(req.body.book);

  const imageFile = req.file; // Utilise req.file pour accéder au fichier d'image

  // Extraction de l'userId :
  // .split('')[1] permet de split notre token comme ci : token =>  "Bearer eyJhb..." => grace a l'espace + [1] pour signifier de lire le token et pas Bearer (en position 0)
  const token = req.headers.authorization.split(' ')[1];
  const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  //   => {
  //   userId: '64f339e1a2832d872b5da536',
  //   iat: 1694010859,
  //   exp: 1694097259
  // }

  const userId = decodedToken.userId;
  // Lisez le fichier image et enregistrez-le dans le dossier "images"
  const imageExtension = imageFile.originalname;
  const imageName = `${Date.now()}.${imageExtension}`;

  // Compression de l'image (Green Code)
  function compressedPhoto() {
    fs.writeFileSync(`./images/${imageName}`, imageFile.buffer);
    sharp(`./images/${imageName}`)
      .resize(800, 600)
      .toFile(`./images/compressed_${imageName}`, (err) => {
        if (err) {
          console.error("Erreur lors de la compression de l'image :", err);
        } else {
          console.log('Image compressée avec succès !');
          fs.unlinkSync(`./images/${imageName}`);
        }
      });
  }

  const imageUrl = `${req.protocol}://${req.get('host')}/images/compressed_${imageName}`;
  const book = new model.Book({
    userId,
    title,
    author,
    year,
    genre,
    imageUrl,
    ratings,
    averageRating,
  });
  try {
    await book.save().then((response) => {
      compressedPhoto();
      // Traitement des réponses réussies
      return res.status(200).json(savedBook);
    });
  } catch (error) {
    if (error.response && error.response.status === 500) {
      // Remplacer le message d'erreur générique par votre propre message
      error.message = 'Le serveur a rencontré une erreur. Veuillez réessayer plus tard.';
    }

    return res.status(500).json(error.message);
  }
});

// ------------------------------------------------------------------------------
// POST : Définit la note pour le user ID fourni. La note doit être comprise entre 0 et 5. L'ID de l'utilisateur et la note doivent être ajoutés au tableau "rating" afin de ne pas laisser un utilisateur noter deux fois le même livre
bookRoutes.post('/api/books/:id/rating', auth, async (req, res) => {
  const newRatings = req.body;

  const book = await model.Book.findOne({ _id: req.params.id });

  if (!book) {
    return res.status(404).json({ error: 'Livre non trouvé.' });
  }

  // Vérifiez si l'utilisateur a déjà noté ce livre
  const userRatingIndex = book.ratings.findIndex((rating) => rating.userId === newRatings.userId);

  if (userRatingIndex !== -1) {
    return res.status(400).json({ error: "L'utilisateur a déjà noté ce livre." });
  }

  // Ajout de la nouvelle notation au tableau "ratings" du livre
  book.ratings.push({ userId: newRatings.userId, grade: newRatings.rating });

  // Calculez la nouvelle note moyenne
  let totalRating = 0;
  book.ratings.forEach((rating) => {
    totalRating += rating.grade;
  });
  book.averageRating = (totalRating / book.ratings.length).toFixed(2);

  try {
    await book.save();
    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la notation du livre.' });
  }
});

// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

// PUT : Met à jour le livre avec l'_id fourni
bookRoutes.put('/api/books/:id', auth, async (req, res) => {
  try {
    const updatedBook = await model.Book.findOneAndUpdate({ _id: req.params.id }, { $set: req.body }, { new: true });
    res.status(200).json(updatedBook);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la modification du livres.' });
  }
});

// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

// DELETE : Supprime le livre avec l'_id fourni ainsi que l’image associée.
bookRoutes.delete('/api/books/:id', auth, async (req, res) => {
  try {
    const deleteBook = await model.Book.findOneAndDelete({ _id: req.params.id });
    const imageName = deleteBook.imageUrl.split('images/')[1];
    // Suppression de l'image coté local (dossier images)
    fs.unlinkSync(`./images/${imageName}`);
    res.status(200).json(deleteBook);
  } catch (error) {
    res.status(500).json({ error: 'Une erreur est survenue lors de la suppression du livre.' });
  }
});

module.exports = bookRoutes;
