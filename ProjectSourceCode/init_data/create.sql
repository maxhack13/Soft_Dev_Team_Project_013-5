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

    

