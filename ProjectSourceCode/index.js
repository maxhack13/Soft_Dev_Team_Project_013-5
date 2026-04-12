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
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'resources/images/uploads/'));
    },
    filename: (req, file, cb) => {
    cb(null, req.session.user.username + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
    extname: 'hbs',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
    helpers: {
        eq: (a,b) => a === b,
        JSON: function(obj) {
            return JSON.stringify(obj);
        },
    },
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
        description: 'Track all of your stock market trades and investments here.' 
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

// Make profile available on all pages
app.use(async (req, res, next) => {
    if (req.session.user) {
        try {
            const userProfile = await db.oneOrNone(
                'SELECT * FROM user_profile WHERE username = $1',
                [req.session.user.username]
            );
            res.locals.userProfile = userProfile;
        } catch (err) {
            res.locals.userProfile = null;
        }
    }
    next();
});

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

app.get('/Trading', auth, async (req, res) => {
    const ticker = req.query.ticker; // Gets ticker from search form (?ticker=AAPL)
    
    // If no ticker searched, just show the search form
    if (!ticker) {
        return res.render('pages/Trading', { stock: null, news: null, ticker: null });
    }

    try {
        // Call Alpha Vantage for stock quote
        const quoteResponse = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: ticker,
                apikey: process.env.API_KEY
            }
        });

        const quoteData = quoteResponse.data['Global Quote'];
        let stock = null;

        if (quoteData && quoteData['01. symbol'] && quoteData['05. price'] && quoteData['05. price'] !== '0.0000') {
            stock = {
                symbol: quoteData['01. symbol'],
                price: parseFloat(quoteData['05. price']).toFixed(2),
                change: parseFloat(quoteData['09. change']).toFixed(2),
                changePercent: quoteData['10. change percent'],
                high: parseFloat(quoteData['03. high']).toFixed(2),
                low: parseFloat(quoteData['04. low']).toFixed(2),
                volume: parseInt(quoteData['06. volume']).toLocaleString(),
            };
        }

        // Call Alpha Vantage for news
        const newsResponse = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'NEWS_SENTIMENT',
                tickers: ticker,
                limit: 5,
                apikey: process.env.API_KEY
            }
        });

        const newsData = newsResponse.data.feed || [];
        const news = newsData.slice(0, 5).map(article => ({
            title: article.title,
            url: article.url,
            source: article.source,
            summary: article.summary ? article.summary.substring(0, 150) + '...' : '',
        }));

        res.render('pages/Trading', { stock, news, ticker });
    } catch (err) {
        console.error('Trading API error:', err.message);
        res.render('pages/Trading', { stock: null, news: null, ticker, error: true });
    }
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
    const isFavorited = req.body.is_favorited; 

    try {
        if (isFavorited) {
            await db.none(`DELETE FROM user_favorites WHERE username = $1 AND app_name = $2`, [username, appName]);
        } else {
            await db.none(`INSERT INTO user_favorites (username, app_name) VALUES ($1, $2)`, [username, appName]);
        }

        res.json({success: true, newState: !isFavorited});
    } catch (err) {
        console.log(err);
        res.status(500).json({success: false, message: 'Favorite error', error: true});
    }
});

// ---- Chat Routes ----

app.get('/chat', auth, async (req, res) => {
    const selectedFriend = req.query.friend || null;
    try {
        const friends = await db.any(
            `SELECT friend_id FROM friends WHERE user_id = $1 ORDER BY friend_id ASC`,
            [req.session.user.username]
        );

        let messages = [];
        if (selectedFriend) {
            messages = await db.any(
                `SELECT * FROM messages 
                 WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1) 
                 ORDER BY sent_at ASC`,
                [req.session.user.username, selectedFriend]
            );
        }

        res.render('pages/chat', { friends, messages, selectedFriend, currentUser: req.session.user.username });
    } catch (err) {
        console.log(err);
        res.render('pages/chat', { friends: [], messages: [], message: 'Error loading chat.', error: true });
    }
});

app.post('/chat/send', auth, async (req, res) => {
    const sender = req.session.user.username;
    const receiver = req.body.receiver;
    const msg = req.body.message;

    if (!receiver || !msg) {
        return res.redirect('/chat');
    }

    try {
        await db.none(
            `INSERT INTO messages (sender, receiver, message) VALUES ($1, $2, $3)`,
            [sender, receiver, msg]
        );
        res.redirect('/chat?friend=' + encodeURIComponent(receiver));
    } catch (err) {
        console.log(err);
        res.redirect('/chat?friend=' + encodeURIComponent(receiver));
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

     // Get favorite recipes
            const username = req.session.user.username;
            const favoriteRecipes = await db.any(`
                SELECT favorite_recipes.recipe_id, favorite_recipes.recipe_name, favorite_recipes.cuisine
                FROM favorite_recipes
                JOIN users_to_favorite_recipes ON favorite_recipes.recipe_id = users_to_favorite_recipes.recipe_id
                WHERE users_to_favorite_recipes.username = $1;`
                , [username]
            );
            console.log(JSON.stringify(favoriteRecipes, null, 2));

    res.render('pages/Recipe', { randomRecipe: randomRecipe, favoriteRecipes: favoriteRecipes ?? [] });
  })
  .catch(error => {
    res.render('pages/Recipe', { message: "Error"});
});
  }
 else {
    const result = await db.any('SELECT recipe_of_the_day FROM recipeOfTheDay WHERE id = 1');
    const randomRecipe = result[0].recipe_of_the_day;

     // Get favorite recipes
            const username = req.session.user.username;
            const favoriteRecipes = await db.any(`
                SELECT favorite_recipes.recipe_id, favorite_recipes.recipe_name, favorite_recipes.cuisine
                FROM favorite_recipes
                JOIN users_to_favorite_recipes ON favorite_recipes.recipe_id = users_to_favorite_recipes.recipe_id
                WHERE users_to_favorite_recipes.username = $1;`
                , [username]
            );
            console.log(JSON.stringify(favoriteRecipes, null, 2));

    res.render('pages/Recipe', { randomRecipe: randomRecipe, favoriteRecipes: favoriteRecipes ?? []});
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

            // Get Filtered Recipes
            const searchedRecipes = results.data;

            // Get Recipe of the Day
            const getRecipeOfTheDay = await db.any('SELECT recipe_of_the_day FROM recipeOfTheDay WHERE id = 1');
            const randomRecipe = getRecipeOfTheDay[0].recipe_of_the_day;

            // Get favorite recipes
            const username = req.session.user.username;
            const favoriteRecipes = await db.any(`
                SELECT favorite_recipes.recipe_id, favorite_recipes.recipe_name, favorite_recipes.cuisine
                FROM favorite_recipes
                JOIN users_to_favorite_recipes ON favorite_recipes.recipe_id = users_to_favorite_recipes.recipe_id
                WHERE users_to_favorite_recipes.username = $1;`
                , [username]
            );
            console.log(JSON.stringify(favoriteRecipes, null, 2));

            // return
            res.render('pages/Recipe', { randomRecipe: randomRecipe, filteredRecipes: searchedRecipes, selectedCuisine: req.query.cuisine, favoriteRecipes: favoriteRecipes ?? []});
        })
        .catch(error => {
            res.render('pages/Recipe', { message: "Error"});
        });
});

app.post('/Recipe/addFavorite', auth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const { recipe_id, recipe_name, cuisine } = req.body;

        // Insert into favorite_recipes if it doesn't exist yet
        await db.none(`
            INSERT INTO favorite_recipes (recipe_id, recipe_name, cuisine)
            VALUES ($1, $2, $3)
            ON CONFLICT (recipe_id) DO NOTHING
        `, [recipe_id, recipe_name, cuisine]);

        // Link the user to the recipe
        await db.none(`
            INSERT INTO users_to_favorite_recipes (username, recipe_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [username, recipe_id]);

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.post('/Recipe/removeFavorite', auth, async (req, res) => {
    try {
        const username = req.session.user.username;
        const { recipe_id } = req.body;

        // Remove the link between user and recipe
        await db.none(`
            DELETE FROM users_to_favorite_recipes
            WHERE username = $1 AND recipe_id = $2
        `, [username, recipe_id]);

        // Clean up favorite_recipes if no other users have it favorited
        await db.none(`
            DELETE FROM favorite_recipes
            WHERE recipe_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM users_to_favorite_recipes
                WHERE recipe_id = $1
            )
        `, [recipe_id]);

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// GET /profile
app.get('/profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const profile = await db.oneOrNone(
            'SELECT * FROM user_profile WHERE username = $1',
            [req.session.user.username]
        );
        const favorites = await db.any(
            'SELECT * FROM user_favorites WHERE username = $1',
            [req.session.user.username]
        );

        const favoritesWithDetails = favorites.map(fav => {
            const app = MINI_APPS.find(a => a.name === fav.app_name);
            return { ...fav, image: app?.image, route: app?.route };
        });

        res.render('pages/profile', {
            user: req.session.user.username,
            profile,
            favorites: favoritesWithDetails
        });
    } catch (error) {
        console.log('ERROR:', error.message || error);
    }
});

// POST /profile/update
app.post('/profile/update', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { email } = req.body;
    try {
        await db.none(
            `INSERT INTO user_profile (username, email)
             VALUES ($1, $2)
             ON CONFLICT (username)
             DO UPDATE SET email = $2`,
            [req.session.user.username, email]
        );
        res.redirect('/profile');
    } catch (error) {
        console.log('ERROR:', error.message || error);
    }
});

// POST /profile/upload
app.post('/profile/upload', upload.single('profile_picture'), async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const imagePath = '/images/uploads/' + req.file.filename;
        await db.none(
            `INSERT INTO user_profile (username, profile_picture)
             VALUES ($1, $2)
             ON CONFLICT (username)
             DO UPDATE SET profile_picture = $2`,
            [req.session.user.username, imagePath]
        );
        res.redirect('/profile');
    } catch (error) {
        console.log('ERROR:', error.message || error);
    }
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