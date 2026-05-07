# emerald-setup-android-env

GitHub Action to set up an Android environment.

## Description

Downloads Android command line tools and installs Java and Gradle within the working directory.

## Inputs

| Name         | Required | Description    |
|--------------|----------|----------------|
| `jdkVersion` | true     | JDK version    |

## Usage

```yaml
- uses: ./emerald-setup-android-env
  with:
    jdkVersion: '17'
```
