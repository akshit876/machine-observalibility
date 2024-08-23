# Use the official Node.js 18 image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Install necessary packages for building native modules (like SerialPort)
RUN apk add --no-cache make gcc g++ python3 libx11-dev libxtst-dev libpng-dev libx11 libx11-dev libxtst

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port that the app will run on
EXPOSE 3000

# Set environment variables for development
ENV NODE_ENV=development

# Command to start the Next.js application in development mode
CMD ["npm", "run", "dev"]