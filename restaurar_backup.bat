@echo off
echo ===================================================
echo RESTAURACAO DE SEGURANCA - GUIA ESCOLAR
echo ===================================================
echo Este script restaura os arquivos para o estado exato antes da importacao de 18/11/2026.
pause
echo Restaurando arquivos de dados...
copy /Y "backup_seguro_pre_importacao_20261118\*" "src\data\"
echo Restaurando git...
git checkout backup-estado-atual-20261118 -- src/
echo Concluido com sucesso! O sistema foi restaurado para o estado anterior.
pause