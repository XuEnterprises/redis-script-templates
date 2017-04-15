## Redis Script Templates

Brings the power of ES6 string template literals to Redis Scripting! No need to remember indexes into ARGV and KEYS anymore!

Installation:
```bash
npm install --save redis-script-templates
```

Usage:

```javascript
import * as RedisScript from 'redis-script-templates'

const script = RedisScript.script`
local a = tonumber(redis.call('get', ${RedisScript.key('theKey')}))
redis.call('set', ${RedisScript.key('otherKey')}, ${RedisScript.arg('aValue')})
return a`

// then later

const scriptResult = await script.execute(redisServer, {
  keys: {
    theKey: 'hello',
    otherKey: 'world',
  },
  args: {
    aValue: 42,
  },
})
    
```

### API

#### RedisScript#script(...)
This function is the core of this package and creates Redis scripts. By default it will use an executor function that works with `thunk-redis`, however you can pass in any executor function of the form:

`(redis: Object, script: string, keyCount: number, keys: Array<string>, args: Array<any>): Promise<any>`

to use a custom executor.

Example of a custom executor:

```javascript
const script = RedisScript.script(RedisScript.redisExecutor)`return redis.call('get', ${RedisScript.key('aKey')})`
```

This package contains the functions `RedisScript#redisThunkExecutor` and `RedisScript#redisExecutor` by default.

`redisExecutor` works with https://github.com/NodeRedis/node_redis and `redisThunkExecutor` works with https://github.com/thunks/thunk-redis

#### RedisScript#key(value: string) => Token
returns a token that resolves to a key (`KEYS[n]`) in the generated script

#### RedisScript#arg(value: string) => Token
returns a token that resolves to an arg (`ARGV[n]`) in the generated script

#### RedisScript#number(value: number) => Token
returns a token that resolves to a number in the generated script

#### RedisScript#string(value: string) => Token
returns a token that resolves to a string in the generated script
