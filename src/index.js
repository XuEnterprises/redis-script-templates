/**
 * @author David Xu
 * @flow
 */

import 'regenerator-runtime/runtime'

type Token = {type: string, value: string}

export const key = (key: string): Token => ({
  type: 'key',
  value: key,
})

export const arg = (key: string): Token => ({
  type: 'arg',
  value: key,
})

export const string = (value: string): Token => ({
  type: 'string',
  value,
})

export const number = (value: number): Token => ({
  type: 'number',
  value: String(value),
})

const constructScript = (executorFunc: Function | null) => {
  return (parts: Array<string>, ...args: Array<Token>) => {
    const keyMapping: { [key: string]: number } = {}
    const argMapping: { [arg: string]: number } = {}
    let keyCount = 0
    let argCount = 0

    let script = ''

    for (let i = 0; i < parts.length; i++) {
      script += parts[i]

      if (i < parts.length - 1) {
        const arg = args[i]

        if (arg.type === 'key') {
          if (!keyMapping[arg.value]) {
            keyCount++
            keyMapping[arg.value] = keyCount
          }

          script += `KEYS[${keyMapping[arg.value]}]`
        } else if (arg.type === 'arg') {
          if (!argMapping[arg.value]) {
            argCount++
            argMapping[arg.value] = argCount
          }

          script += `ARGV[${argMapping[arg.value]}]`
        } else if (arg.type === 'string') {
          script += `'${arg.value}'`
        } else if (arg.type === 'number') {
          script += arg.value
        } else {
          throw new Error(`unknown arg token type: ${arg.type}`)
        }
      }
    }

    const ret: Script<typeof keyMapping, typeof argMapping> = new Script(script.trim(), keyMapping, argMapping, executorFunc)

    return ret
  }
}

export const script = (parts: Array<string> | Function, ...args: Array<Token>) => {
  if (typeof parts === 'function') {
    return constructScript(parts)
  }

  return constructScript(null)(parts, ...args)
}

const defaultExecutor = async (redis: Object, script: string, keyCount: number, keys: Array<string>, args: Array<any>) => {
  return await redis.evalauto(
    script,
    keyCount,
    ...keys,
    ...args,
  )
}

export const redisExecutor = (redis: Object, script: string, keyCount: number, keys: Array<string>, args: Array<any>) => {
  return new Promise((resolve, reject) => {
    redis.eval(
      script,
      keyCount,
      ...keys,
      ...args,
      (err, result) => {
        if (err) return reject(err)

        return resolve(result)
      }
    )
  })
}

export const redisThunkExecutor = defaultExecutor

class Script<
  Keys: {[key: string]: number},
  Argv: {[arg: string]: number},
> {

  _script: string
  _keyMapping: Keys
  _argMapping: Argv
  _keyCount: number
  _argCount: number
  _executor: Function

  constructor(
    script: string,
    keyMapping: Keys,
    argMapping: Argv,
    executor: Function | null,
  ) {
    this._script = script
    this._keyMapping = keyMapping
    this._argMapping = argMapping
    this._keyCount = Object.keys(keyMapping).length
    this._argCount = Object.keys(argMapping).length
    this._executor = executor || defaultExecutor
  }

  get script(): string {
    return this._script
  }

  get argCount(): number {
    return this._argCount
  }

  get keyCount(): number {
    return this._keyCount
  }

  async execute(redis: Object, {
    keys,
    args,
  }: {
    keys: { [key: $Keys<Keys>]: string },
    args: { [arg: $Keys<Argv>]: any },
  }) {
    const keyArray = new Array(this._keyCount)
    const argArray = new Array(this._argCount)

    for (let key in this._keyMapping) {
      keyArray[this._keyMapping[key] - 1] = keys[key]
    }

    for (let arg in this._argMapping) {
      argArray[this._argMapping[arg] - 1] = args[arg]
    }

    return await this._executor(
      redis,
      this._script,
      this._keyCount,
      keyArray,
      argArray,
    )
  }

}
