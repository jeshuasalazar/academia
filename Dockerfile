FROM node:18

WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Exponer puerto predeterminado (Railway lo sobrescribirá dinámicamente)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
