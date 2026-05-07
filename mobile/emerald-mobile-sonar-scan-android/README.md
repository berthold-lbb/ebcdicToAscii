# emerald-mobile-sonar-scan-android

GitHub Action pour lancer un scan SonarQube sur un projet Android.

## Description

Exécute un scan Sonar à partir de la tâche gradle.

## Inputs

| Name               | Required | Description                                          |
|--------------------|----------|------------------------------------------------------|
| `sonar-token`      | true     | Token Sonarqube                                      |
| `sonar-url`        | true     | URL du serveur Sonarqube                             |
| `extra-arguments`  | false    | Arguments supplémentaires pour la commande gradle sonar |

## Usage

```yaml
- uses: ./emerald-mobile-sonar-scan-android
  with:
    sonar-token: ${{ secrets.SONAR_TOKEN }}
    sonar-url: ${{ secrets.SONAR_HOST_URL }}
```
