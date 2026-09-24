# Fast_Prod - Dockerfile per applicazione Officina
FROM nginx:alpine

# Copia i file dell'applicazione web nel percorso predefinito di Nginx
COPY . /usr/share/nginx/html

# Copia la configurazione personalizzata di Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Espone la porta 80
EXPOSE 80

# Avvia Nginx in primo piano
CMD ["nginx", "-g", "daemon off;"]
