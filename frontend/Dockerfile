# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for Vite env variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json ./
RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built static files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
