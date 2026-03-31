// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars'); //to enable express to work with handlebars
const Handlebars = require('handlebars'); // to include the templating engine responsible for compiling templates
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
    extname: 'hbs',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
    host: 'db', // the database server
    port: 5432, // the database port
    database: process.env.POSTGRES_DB, // the database name
    user: process.env.POSTGRES_USER, // the user account to connect with
    password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
    .then(obj => {
        console.log('Database connection successful'); // you can view this message in the docker compose logs
        obj.done(); // success, release the connection;
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.
app.use(express.static(path.join(__dirname, 'public'))); // serve static files (images, CSS, etc.) from the public folder

// initialize session variables
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
    })
);

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// TODO - Include your API routes here

app.get('/', (req, res) => {
    res.redirect('/login'); //this will call the /login route in the API
});

app.get('/register', (req, res) => {
    res.render('pages/register'); //this will call my /register route in the API
});

app.post('/register', async (req, res) => {
    //hash the password using bcrypt library
    const hash = await bcrypt.hash(req.body.password, 10);

    // To-DO: Insert username and hashed password into the 'users' table
    const query = `INSERT INTO users (username, password) VALUES ($1, $2)`;
    db.none(query, [req.body.username, hash])
        .then((response) => {
            res.redirect('/login');
        })
        .catch((err) => {
            res.render('pages/register', { message: 'Username already exists.', error: true });
        });
});

app.get('/login', (req, res) => {
    res.render('pages/login');   //same as one above
});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const user = await db.oneOrNone(`SELECT * FROM users WHERE username = $1`, [username]);

    if (!user) {
        return res.redirect('/register');
    }
    const match = await bcrypt.compare(password, user.password);

    if (match) {
        req.session.user = user;
        req.session.save();
        res.redirect('/discover');
    } else {
        res.render('pages/login', { message: 'Incorrect username or password.', error: true });
    }
});



// Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
        // Default to login page.
        return res.redirect('/login');
    }
    next();
};

// Authentication Required

app.get('/discover', auth, (req, res) => {
    res.render('pages/discover');
});

app.get('/SnowReport', auth, (req, res) => {
    res.render('pages/SnowReport');
});

app.get('/Trading', auth, (req, res) => {
    res.render('pages/Trading');
});

app.get('/Recipe', auth, (req, res) => {
    res.render('pages/Recipe');
});


app.get('/logout', auth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/discover');
        }
        res.render('pages/logout', { message: 'Logged out Successfully' });
    });
});



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3001);
console.log('Server is listening on port 3001');