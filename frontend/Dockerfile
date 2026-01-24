# Build Stage
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build the app (requires VITE_API_URL arg)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Production Stage
FROM node:22-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

# Cloud Run sets PORT variable (verify if default is 8080)
# serve uses -l to set port
CMD ["sh", "-c", "serve -s dist -l $PORT"]
