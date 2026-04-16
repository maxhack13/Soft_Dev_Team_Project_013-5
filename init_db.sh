#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://users_db_zcn0_user:j1BXZUvIE9J1Opiwb8KPoPkVVg7SYsmv@dpg-d7gkjsq8qa3s73eh26jg-a.oregon-postgres.render.com/users_db_zcn0"

# Execute each .sql file in the directory
for file in ProjectSourceCode/init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done