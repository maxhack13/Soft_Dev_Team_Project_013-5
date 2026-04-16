# MyMiniDashboard

## Group 013-5

### Description
MyMiniDashboard is an all-inclusive application that serves as a central hub for users' interests and fosters social interaction. Users can create accounts, customize their profiles, add friends, and chat with each other to share common passions. We have a dynamic collection of mini-apps for users to explore and enjoy. Users can tailor their dashboard to feature topics they care about by favoriting certain mini-apps on the Search page, which are then displayed on their public profiles.

**Current Mini-Apps Included:**
- **Snow Report:** View 7-day forecasts and snow quality at a variety of popular ski resorts. Users can log upcoming ski trips at specific resorts, which are showcased on their profile so friends can coordinate meetups.
- **Trading Tracker:** A financial visualization tool that allows users to track stock tickers, view real-time market data, and track price changes.
- **Recipe Finder:** Discover culinary inspiration through a daily featured meal or search for options that interest you by cuisine type. Users can save their favorite recipes and share them with friends.

### Contributors
- Max Hack
- Ethan Cuthrell
- John Bartlett
- Aidan White

### Technology Stack
- HTML/CSS
- Handlebars (HBS)
- Node.js
- Express
- Docker
- PostgreSQL
- Render

**External APIs:**
- Open-Meteo (Snow Report)
- Alpha Vantage (Trading Tracker)
- TheMealDB (Recipe Finder)

### Prerequisites
- Docker installed and running
- The user's desired code compiler
- Access to a web browser

### Usage
Clone the repository:
```
git clone https://github.com/maxhack13/Soft_Dev_Team_Project_013-5.git
cd Soft_Dev_Team_Project_013-5
```

Create your `.env` file in the `/ProjectSourceCode` folder following the provided format:
```
# database credentials
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="pwd"
POSTGRES_DB="users_db"

# Node vars
SESSION_SECRET="super duper secret!"
API_KEY="Your API Key Here!"
```

Run Docker Compose:
```
docker compose up
```

Visit the following address in your browser:
```
http://localhost:3001/
```

### Running Tests
Tests will automatically be run when the Docker container is set up by running `docker compose up`.

### Link to Application
[myminidashboard.onrender.com](https://myminidashboard.onrender.com/)


