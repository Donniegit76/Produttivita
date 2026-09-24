# Fast_Prod - Production Node.js Server Dockerfile
FROM node:18-alpine

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file del pacchetto
COPY package*.json ./

# Installa le dipendenze di produzione (Express, Cors)
RUN npm install --only=production

# Copia tutti i file del progetto
COPY . .

# Crea la directory per il database persistente
RUN mkdir -p /app/data

# Espone la porta del server (8080)
EXPOSE 8080

# Variabile d'ambiente porta
ENV PORT=8080

# Avvia il server Express con Database Persistente
CMD ["node", "server/server.js"]
