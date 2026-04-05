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

CREATE TABLE IF NOT EXISTS recipeOfTheDay (
    id INT PRIMARY KEY DEFAULT 1,
    recipe_date VARCHAR(30),
    recipe_of_the_day JSON,
    CONSTRAINT one_row CHECK (id = 1)
);

INSERT INTO recipeOfTheDay (id, recipe_date, recipe_of_the_day) 
VALUES (1, 'lol', '{"lol": "lmao"}');