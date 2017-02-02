# heroku-ps-wait

Applications in Heroku Private Spaces cycle dynos one at a time when 
a new release is made. This command allows you to wait until
all dynos are on the latest release version.

### Usage

`heroku ps:wait --app sushi`

This can be especially useful combined with desktop
notifications. E.g., on Ubuntu, you can use `notify-send`:

```bash
heroku ps:wait --app sushi && notify-send 'sushi release is live'
```

### Installation

```bash
$ heroku plugins:install uhoh-itsmaciek/heroku-ps-wait
```

#### Update

```bash
$ heroku plugins:update heroku-ps-wait
```

## THIS IS BETA SOFTWARE

Thanks for trying it out. If you find any problems, please report an
issue and include your Heroku toolbelt version and your OS version.
