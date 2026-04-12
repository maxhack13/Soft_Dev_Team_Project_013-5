CREATE TABLE IF NOT EXISTS users(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS friends(
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(username),
    friend_id VARCHAR(50) NOT NULL REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    CHECK(user_id <> friend_id)
);

/* Recipe App Data */
CREATE TABLE IF NOT EXISTS recipeOfTheDay (
    id INT PRIMARY KEY DEFAULT 1,
    recipe_date VARCHAR(30),
    recipe_of_the_day JSON,
    CONSTRAINT one_row CHECK (id = 1)
);

INSERT INTO recipeOfTheDay (id, recipe_date, recipe_of_the_day) 
VALUES (1, 'lol', '{"lol": "lmao"}');

CREATE TABLE IF NOT EXISTS favorite_recipes(
    recipe_id VARCHAR(50) PRIMARY KEY,
    recipe_name VARCHAR(100) NOT NULL,
    cuisine VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS users_to_favorite_recipes(
    username VARCHAR(50) NOT NULL REFERENCES users(username),
    recipe_id VARCHAR(50) NOT NULL REFERENCES favorite_recipes(recipe_id),
    PRIMARY KEY (username, recipe_id)  -- Prevents duplicate favorites per user
);

/* Dashboard */
CREATE TABLE IF NOT EXISTS user_favorites(
    username VARCHAR(50) NOT NULL REFERENCES users(username),
    app_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (username, app_name)
);