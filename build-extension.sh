#!/bin/bash

# Nome do arquivo de saída
ZIP_NAME="auto-proposal-extension.zip"
DEST_DIR="dashboard/public"

echo "📦 Iniciando build da extensão..."

# Remove zip antigo se existir
rm -f $ZIP_NAME

# Cria o zip excluindo pastas desnecessárias
zip -r $ZIP_NAME . -x "dashboard/*" "api/*" "docs/*" ".git/*" "node_modules/*" "*.zip" "*.sh" ".DS_Store" "._*"

# Move para a pasta public do dashboard
mv $ZIP_NAME $DEST_DIR/

echo "✅ Build concluída! O arquivo está em $DEST_DIR/$ZIP_NAME"
