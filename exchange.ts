# Ferme Android Studio d'abord, puis :

# Trouver le fichier
find ~/Library/Application\ Support/Google/AndroidStudio* -name "jdk.table.xml" 2>/dev/null


~/Library/Application Support/Google/AndroidStudio2024.x/options/jdk.table.xml

cp jdk.table.xml jdk.table.xml.backup

rm ~/Library/Application\ Support/Google/AndroidStudio*/options/jdk.table.xml