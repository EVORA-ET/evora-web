# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build the production application
RUN npm run build


# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Add our Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Vite production build
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]