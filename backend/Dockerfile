# Use Node 20 Alpine as base
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Build the TypeScript code (optional for dev, but good for checks)
RUN npm run build

# Expose the port
EXPOSE 8080

# Default command (overridden by docker-compose)
CMD ["npm", "start"]
