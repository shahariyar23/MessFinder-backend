# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your app's source code
COPY . .

EXPOSE 8000

# Start the app
CMD ["node", "src/index.js"]
