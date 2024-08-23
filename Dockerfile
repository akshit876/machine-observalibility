FROM node:18

# Install build tools and X11 development libraries
RUN apt-get update && apt-get install -y \
  build-essential \
  python3 \
  libx11-dev \
  libxtst-dev \
  libxi-dev \
  && rm -rf /var/lib/apt/lists/*

# Update npm and node-gyp
RUN npm install -g npm@latest node-gyp@latest

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose port and start application
EXPOSE 3000
CMD ["node", "index.js"]
