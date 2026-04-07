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

app.use(express.static(path.join(__dirname, 'resources'))); // Access resources folder at the root url, e.g. to access resources/css/default.css, use /css/home.css

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// List of Mini Apps
const MINI_APPS = [
    { 
        name: 'Snow Report', 
        route: '/SnowReport', 
        image: '/Images/SnowReport.png', 
        description: 'Check the latest snow report for your favorite ski resort.' 
    },
    { 
        name: 'Trading Tracker', 
        route: '/Trading', 
        image: '/Images/TradingImage.jpg', 
        description: 'Track your stock market trades and investments.' 
    },
    { 
        name: 'Recipe of the Day', 
        route: '/Recipe', 
        image: '/Images/Recipe.png', 
        description: "Check out today's featured recipe and cook something new!" 
    }
];

// TODO - Include your API routes here

app.get('/', (req, res) => {
    res.redirect('/login'); //this will call the /login route in the API
});

app.get('/register', (req, res) => {
    res.render('pages/register'); //this will call my /register route in the API
});

app.post('/register', async (req, res) => {
    // Validate input first
    if (!req.body.username || !req.body.password) {
        return res.status(400).render('pages/register', { message: 'Missing input', error: true });
    }

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
        res.status(400).render('pages/login', { message: 'Incorrect username or password.', error: true });
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

app.get('/discover', auth, async (req, res) => {
    try {
        const favs = await db.any(`SELECT app_name FROM user_favorites WHERE username = $1`, [req.session.user.username]);
        const userApps = MINI_APPS.filter(app => favs.map(f => f.app_name).includes(app.name));
        
        res.render('pages/discover', {apps: userApps});
    } catch (err) {
        console.log(err);
        res.render('pages/discover', {
            apps: [],
            message: 'Discover error',
            error: true 
        });
    }
});

// Ski resort coordinates (name -> lat/lon)
const skiResorts = {
    'Vail, CO': { lat: 39.64, lon: -106.37 },
    'Breckenridge, CO': { lat: 39.48, lon: -106.07 },
    'Aspen, CO': { lat: 39.19, lon: -106.82 },
    'Park City, UT': { lat: 40.65, lon: -111.51 },
    'Jackson Hole, WY': { lat: 43.59, lon: -110.83 },
    'Mammoth Mountain, CA': { lat: 37.63, lon: -119.03 },
    'Big Sky, MT': { lat: 45.28, lon: -111.40 },
    'Copper Mountain, CO': { lat: 39.50, lon: -106.14 },
    'Eldora Mountain Resort, CO': { lat: 39.94, lon: -105.56 },
};

app.get('/SnowReport', auth, async (req, res) => {
    const resort = req.query.resort;
    const resortNames = Object.keys(skiResorts); // List of resort names for the dropdown

    // If no resort selected yet, just show the dropdown
    if (!resort || !skiResorts[resort]) {
        return res.render('pages/SnowReport', { forecast: null, resort: null, resortNames });
    }

    try {
        const coords = skiResorts[resort];

        // Call Open-Meteo API
        const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude: coords.lat,
                longitude: coords.lon,
                daily: 'snowfall_sum,temperature_2m_max,temperature_2m_min',
                temperature_unit: 'fahrenheit',
                timezone: 'America/Denver',
                forecast_days: 7
            }
        });

        const daily = response.data.daily;

        const forecast = daily.time.map((date, i) => ({
            date: date,
            snowfall: daily.snowfall_sum[i],
            high: Math.round(daily.temperature_2m_max[i]),
            low: Math.round(daily.temperature_2m_min[i]),
        }));

        res.render('pages/SnowReport', { forecast, resort, resortNames });
    } catch (err) {
        console.error('Snow Report API error:', err.message);
        res.render('pages/SnowReport', { forecast: null, resort, resortNames, error: true });
    }
});

app.get('/Trading', auth, (req, res) => {
    res.render('pages/Trading');
});

app.get('/Recipe', auth, (req, res) => {
    res.redirect('/Recipe/recipeOfTheDay');
});

app.get('/search', auth, async (req, res) => {
    try {
        const favs = await db.any(`SELECT app_name FROM user_favorites WHERE username = $1`, [req.session.user.username]);

        const displayApps = MINI_APPS.map(app => {
            return {
                name: app.name,
                route: app.route,
                image: app.image,
                description: app.description,
                isFavorited: favs.map(f => f.app_name).includes(app.name)
            };
        });

        res.render('pages/Search', {apps: displayApps});
    } catch (err) {
        console.log(err);
        res.render('pages/Search', {
            apps: MINI_APPS,
            message: 'Search error',
            error: true
        });
    }
});

app.post('/favorite/toggle', auth, async (req, res) => {
    const username = req.session.user.username;
    const appName = req.body.app_name;
    const isFavorited = req.body.is_favorited === 'true';

    try {
        if (isFavorited) {
            await db.none(`DELETE FROM user_favorites WHERE username = $1 AND app_name = $2`, [username, appName]);
        } else {
            await db.none(`INSERT INTO user_favorites (username, app_name) VALUES ($1, $2)`, [username, appName]);
        }
        
        res.redirect('/search');
    } catch (err) {
        console.log(err);
        res.redirect('/search');
    }
});

// ---- Friends Routes ----

app.get('/friends', auth, async (req, res) => {
    try {
        const friends = await db.any(
            `SELECT friend_id, created_at FROM friends WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.session.user.username]
        );
        res.render('pages/Friends', { friends });
    } catch (err) {
        console.log(err);
        res.render('pages/Friends', { friends: [], message: 'Error loading friends.', error: true });
    }
});

app.post('/friends/add', auth, async (req, res) => {
    const currentUser = req.session.user.username;
    const friendUsername = req.body.friend_username;

    // Can't friend yourself
    if (currentUser === friendUsername) {
        const friends = await db.any(`SELECT friend_id, created_at FROM friends WHERE user_id = $1 ORDER BY created_at DESC`, [currentUser]);
        return res.render('pages/Friends', { friends, message: "You can't add yourself as a friend.", error: true });
    }

    try {
        // Check if the friend exists
        const friendUser = await db.oneOrNone(`SELECT username FROM users WHERE username = $1`, [friendUsername]);
        if (!friendUser) {
            const friends = await db.any(`SELECT friend_id, created_at FROM friends WHERE user_id = $1 ORDER BY created_at DESC`, [currentUser]);
            return res.render('pages/Friends', { friends, message: `User "${friendUsername}" does not exist.`, error: true });
        }

        // Insert both directions (mutual friendship)
        await db.tx(async t => {
            await t.none(`INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [currentUser, friendUsername]);
            await t.none(`INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [friendUsername, currentUser]);
        });

        res.redirect('/friends');
    } catch (err) {
        console.log(err);
        const friends = await db.any(`SELECT friend_id, created_at FROM friends WHERE user_id = $1 ORDER BY created_at DESC`, [currentUser]);
        res.render('pages/Friends', { friends, message: 'Error adding friend.', error: true });
    }
});

app.post('/friends/remove', auth, async (req, res) => {
    const currentUser = req.session.user.username;
    const friendUsername = req.body.friend_username;

    try {
        // Delete both directions (mutual)
        await db.none(
            `DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [currentUser, friendUsername]
        );
        res.redirect('/friends');
    } catch (err) {
        console.log(err);
        const friends = await db.any(`SELECT friend_id, created_at FROM friends WHERE user_id = $1 ORDER BY created_at DESC`, [currentUser]);
        res.render('pages/Friends', { friends, message: 'Error removing friend.', error: true });
    }
});

app.get('/logout', auth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/discover');
        }
        res.render('pages/logout', { message: 'Logged out Successfully' });
    });
});

// ---- Recipe Routes ---- //

app.get('/Recipe/recipeOfTheDay', auth, async (req, res) => {
 try{
 const date = new Date().toISOString().split('T')[0];
 const current_date_query = await db.any('SELECT recipe_date FROM recipeOfTheDay WHERE id = 1');
const current_date = current_date_query[0].recipe_date;
 if(date != current_date){
  await db.query(
    'UPDATE recipeOfTheDay SET recipe_date = $1 WHERE id = 1', [date]
  );
  axios({
  url: `https://www.themealdb.com/api/json/v1/1/random.php`,
  method: 'GET',
  dataType: 'json',
  headers: {
    'Accept-Encoding': 'application/json',
  },
  })
  .then(async results => {
    console.log(results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
    const randomRecipe = results.data;
    await db.query(
        'UPDATE recipeOfTheDay SET recipe_of_the_day = $1 WHERE id = 1', [randomRecipe]
    );
    res.render('pages/Recipe', { randomRecipe: randomRecipe });
  })
  .catch(error => {
    res.render('pages/Recipe', { message: "Error"});
});
  }
 else {
    const result = await db.any('SELECT recipe_of_the_day FROM recipeOfTheDay WHERE id = 1');
    const randomRecipe = result[0].recipe_of_the_day;
    res.render('pages/Recipe', { randomRecipe: randomRecipe });
}
}
catch(err){
    res.render('pages/Recipe', { message: "Error"});
}
})

app.get('/Recipe/searchByCuisine', auth, async (req, res) => {
        await axios({
            url: `https://www.themealdb.com/api/json/v1/1/filter.php`,
            method: 'GET',
            dataType: 'json',
            headers: {
                'Accept-Encoding': 'application/json',
            },
            params: {
                a: req.query.cuisine
            }
        })
        .then(async results => {
            console.log(results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
            const searchedRecipes = results.data;
            const getRecipeOfTheDay = await db.any('SELECT recipe_of_the_day FROM recipeOfTheDay WHERE id = 1');
            const randomRecipe = getRecipeOfTheDay[0].recipe_of_the_day;
            res.render('pages/Recipe', { randomRecipe: randomRecipe, filteredRecipes: searchedRecipes});
        })
        .catch(error => {
            res.render('pages/Recipe', { message: "Error"});
        });
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3001);
console.log('Server is listening on port 3001');



// lab 10
app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});