# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# A Vite a VITE_* környezeti változókat build időben égeti be a kódba
# (nem futásidőben olvassa), ezért ezeket build argumentumként kell
# átadni a "docker build" hívásakor.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PUBLIC_SITE_URL

# dev supabase
ENV VITE_SUPABASE_URL=https://zuphybugkufsthhrddiq.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1cGh5YnVna3Vmc3RoaHJkZGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODE5NTcsImV4cCI6MjEwMTk1Nzk1N30.Yu-9DHlMjX1QseyK-KLjawDvinZBxQxToc31EZ3P1gY
ENV VITE_PUBLIC_SITE_URL="dev resource. Do not use in prod environment!"

# prod supabase
#ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
#ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
#ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL


COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
