/**
 * @author David Xu
 */

type Token = { type: string, value: string }

type ExecutorFunc<Redis> = (redis: Redis, script: string, keyCount: number, keys: string[], args: any[]) => Promise<any>

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

const constructScript = <T>(executorFunc: ExecutorFunc<T> | null) => {
  return (parts: string[], ...args: Token[]) => {
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

export const script = (parts: string[] | ExecutorFunc<any>, ...args: Token[]) => {
  if (typeof parts === 'function') {
    return constructScript(parts)
  }

  return constructScript(null)(parts, ...args)
}

const defaultExecutor = async (redis: any, script: string, keyCount: number, keys: string[], args: any[]) => {
  return await redis.evalauto(
    script,
    keyCount,
    ...keys,
    ...args,
  )
}

export const redisExecutor = (redis: any, script: string, keyCount: number, keys: string[], args: any[]) => {
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

class Script<Keys extends { [key: string]: number },
  Argv extends { [arg: string]: number },
  > {

  private readonly _script: string
  private readonly _keyMapping: Keys
  private readonly _argMapping: Argv
  private readonly _keyCount: number
  private readonly _argCount: number
  private readonly _executor: ExecutorFunc<any>

  constructor(
    script: string,
    keyMapping: Keys,
    argMapping: Argv,
    executor: ExecutorFunc<any> | null,
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
    keys: Record<keyof Keys, string>,
    args: Record<keyof Argv, any>,
  }) {
    const keyArray: string[] = new Array(this._keyCount)
    const argArray: any[] = new Array(this._argCount)

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
