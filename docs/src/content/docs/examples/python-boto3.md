---
title: "Python (boto3)"
description: "Complete Python examples using boto3 to interact with the cognito-local SDK API."
---

These examples show how to use the [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) AWS SDK for Python with cognito-local.

## Client setup

```python
import boto3

client = boto3.client(
    "cognito-idp",
    region_name="us-east-1",
    endpoint_url="http://localhost:9229",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)
```

The `aws_access_key_id` and `aws_secret_access_key` can be any non-empty string. cognito-local does not validate AWS credentials.

## Authenticate (InitiateAuth)

Authenticate a user with their username or email and password:

```python
response = client.initiate_auth(
    AuthFlow="USER_PASSWORD_AUTH",
    ClientId="my-app-local",
    AuthParameters={
        "USERNAME": "alice@example.com",
        "PASSWORD": "Password1!",
    },
)

tokens = response["AuthenticationResult"]
access_token = tokens["AccessToken"]
id_token = tokens["IdToken"]
refresh_token = tokens["RefreshToken"]

print(f"Access token: {access_token[:50]}...")
```

## Sign up

Register a new user account:

```python
response = client.sign_up(
    ClientId="my-app-local",
    Username="bob",
    Password="SecurePass1!",
    UserAttributes=[
        {"Name": "email", "Value": "bob@example.com"},
        {"Name": "name", "Value": "Bob Smith"},
    ],
)

print(f"User sub: {response['UserSub']}")
print(f"Confirmed: {response['UserConfirmed']}")
```

New users are created in an unconfirmed state. They must be confirmed before they can authenticate.

## Confirm sign up

Confirm a user's registration. cognito-local accepts any non-empty string as the confirmation code:

```python
client.confirm_sign_up(
    ClientId="my-app-local",
    Username="bob",
    ConfirmationCode="123456",
)

print("User confirmed successfully")
```

After confirmation, the user can authenticate using `InitiateAuth`.

## Admin get user

Retrieve detailed information about a user (admin operation):

```python
response = client.admin_get_user(
    UserPoolId="us-east-1_localDev01",
    Username="alice",
)

print(f"Username: {response['Username']}")
print(f"Status: {response['UserStatus']}")
print("Attributes:")
for attr in response["UserAttributes"]:
    print(f"  {attr['Name']}: {attr['Value']}")
```

## Admin update user attributes

Modify a user's attributes:

```python
client.admin_update_user_attributes(
    UserPoolId="us-east-1_localDev01",
    Username="alice",
    UserAttributes=[
        {"Name": "custom:role", "Value": "admin"},
        {"Name": "name", "Value": "Alice Johnson"},
    ],
)

print("User attributes updated")
```

## List users

List users in a user pool, optionally filtering by attribute:

```python
# List all users
response = client.list_users(
    UserPoolId="us-east-1_localDev01",
)

for user in response["Users"]:
    print(f"  {user['Username']} - {user['UserStatus']}")

# Filter by email
response = client.list_users(
    UserPoolId="us-east-1_localDev01",
    Filter='email = "alice@example.com"',
)

for user in response["Users"]:
    attrs = {a["Name"]: a["Value"] for a in user["Attributes"]}
    print(f"  {user['Username']} ({attrs.get('email', 'N/A')})")
```

## Complete example

Here is a full script that signs up a user, confirms them, and authenticates:

```python
import boto3
import json

client = boto3.client(
    "cognito-idp",
    region_name="us-east-1",
    endpoint_url="http://localhost:9229",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

# 1. Sign up
signup_response = client.sign_up(
    ClientId="my-app-local",
    Username="newuser",
    Password="MyPassword1!",
    UserAttributes=[
        {"Name": "email", "Value": "newuser@example.com"},
    ],
)
print(f"Signed up user: {signup_response['UserSub']}")

# 2. Confirm
client.confirm_sign_up(
    ClientId="my-app-local",
    Username="newuser",
    ConfirmationCode="123456",
)
print("User confirmed")

# 3. Authenticate
auth_response = client.initiate_auth(
    AuthFlow="USER_PASSWORD_AUTH",
    ClientId="my-app-local",
    AuthParameters={
        "USERNAME": "newuser",
        "PASSWORD": "MyPassword1!",
    },
)
tokens = auth_response["AuthenticationResult"]
print(f"Authenticated! Token expires in {tokens['ExpiresIn']}s")
```
