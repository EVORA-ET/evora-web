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

# Upstream backend for /api/. Override at runtime with:
#   docker run -e API_UPSTREAM=host.docker.internal:<port> ...
ENV API_UPSTREAM=host.docker.internal:8000

# Add our Nginx configuration as a template. The nginx image runs envsubst
# over /etc/nginx/templates/*.template and writes the result to
# /etc/nginx/conf.d/default.conf, so only API_UPSTREAM is substituted while
# nginx variables like $host and $http_authorization are left intact.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy the Vite production build
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]