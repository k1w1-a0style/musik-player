import { spawnSync } from 'node:child_process';

test('Expo CLI validates plugin input and output and Zod validates MCP commands', () => {
  const script = String.raw`
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const {createRequire} = require('node:module');
    const fromExpo = createRequire(require.resolve('expo/package.json'));
    const cli = path.dirname(fromExpo.resolve('@expo/cli/package.json'));
    const fromCli = createRequire(path.join(cli, 'package.json'));
    assert.equal(fromCli('zod/package.json').version, '4.6.6');
    const {PluginSchema, DevToolsPluginOutputSchema} = require(path.join(cli, 'build/src/start/server/devtools/DevToolsPlugin.schema.js'));
    const {createMCPDevToolsExtensionSchema} = require(path.join(cli, 'build/src/start/server/mcp/createMCPDevToolsExtensionSchema.js'));
    const {validate} = fromCli('@expo/schema-utils');
    const z = fromCli('zod');
    const plugin = {packageName:'fixture',packageRoot:'/tmp/fixture',cliExtensions:{description:'Test',entryPoint:'index.js',commands:[
      {name:'run',title:'Run',environments:['cli','mcp'],parameters:[{name:'count',type:'number'},{name:'confirm',type:'confirm'},{name:'text',type:'text'}]}
    ]}};
    assert.doesNotThrow(() => validate(PluginSchema,plugin));
    assert.throws(() => validate(PluginSchema,{...plugin,packageName:''}));
    const schema = createMCPDevToolsExtensionSchema(plugin,z);
    assert.equal(schema.safeParse({command:'run',count:3,confirm:true,text:'ok'}).success,true);
    assert.equal(schema.safeParse({command:'unknown'}).success,false);
    assert.equal(schema.safeParse({command:'run',count:'3'}).success,false);
    assert.equal(schema.safeParse({command:'run',injected:true}).success,false);
    assert.doesNotThrow(() => validate(DevToolsPluginOutputSchema,[{type:'text',text:'ok',level:'info'}]));
    assert.throws(() => validate(DevToolsPluginOutputSchema,[{type:'image',url:'invalid'}]));
    const result = z.array(z.string()).max(5).safeParse(Array(50000).fill(null));
    assert.equal(result.success,false);
    assert.ok(result.error.issues.length < 10, 'oversized collection must fail before allocating one issue per element');
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
});
