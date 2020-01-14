// app.js
var express = require( 'express' );
var fs = require( 'fs' );
var bodyParser = require( 'body-parser' );
var crypto = require( 'crypto' );
var jwt = require( 'jsonwebtoken' );
var request = require( 'request' );
var app = express();

var settings = require( './settings' );

app.use( express.static( __dirname + '/public' ) );
app.use( bodyParser.urlencoded( { extended: true, limit: '10mb' } ) );
app.use( bodyParser.json() );

var db_dir = settings.dbs_folder;
if( !fs.existsSync( db_dir ) ){
  fs.mkdirSync( db_dir );
}

app.get( '/dbs', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var dbs_folder = settings.dbs_folder;
  var dbnames = fs.readdirSync( dbs_folder );
  var dbs = [];
  dbnames.forEach( function( db ){
    if( db != '.gitkeep' ){
      dbs.push( db );
    }
  });
  res.write( JSON.stringify( { status: true, dbs: dbs }, 2, null ) );
  res.end();
});

app.delete( '/db/:name', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var dbs_folder = settings.dbs_folder;
  var name = req.params.name;
  if( name ){
    var db_dir = settings.dbs_folder + '/' + name;
    if( fs.existsSync( db_dir ) ){
      if( settings.enabledeletedb ){
        var files = fs.readdirSync( db_dir );
        for( var file in files ){
          fs.unlinkSync( db_dir + '/' + files[file] );
        }
        fs.rmdirSync( db_dir );
        res.write( JSON.stringify( { status: true, message: 'db ' + name + ' is deleted.' }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'deleting db feature is not enabled.' }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'db ' + name + ' not existed.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.post( '/db/:name', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var name = req.params.name;
  if( name ){
    var db_dir = settings.dbs_folder + '/' + name;
    if( fs.existsSync( db_dir ) ){
      res.write( JSON.stringify( { status: true, message: 'db ' + name + ' is already created.' }, 2, null ) );
      res.end();
    }else{
      fs.mkdirSync( db_dir );
      res.write( JSON.stringify( { status: true, message: 'db ' + name + ' has been created.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.post( '/block/:name', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var name = req.params.name;
  if( name ){
    var _body = req.body;  //. object or string
    var _nonce = 0;
    var _timestamp = ( new Date() ).getTime();
    var _block = {
      //._id: _id,
      _prev_id: null,
      _nonce: _nonce,
      _timestamp: _timestamp,
      _body: _body
    };

    //. 直前のブロック（の _id ）を見つける
    getLastBlock( name ).then( function( _prev_block ){
      if( _prev_block ){ _block._prev_id = _prev_block._id; }

      var _id = null;
      do{
        _nonce ++;
        _block._nonce = _nonce;

        var hash = crypto.createHash( 'sha512' );
        hash.update( JSON.stringify( _block ) );
        _id = hash.digest( 'hex' );
      }while( settings.zerodigit > 0 && countTopZero( _id ) < settings.zerodigit )

      _block._id = _id;

      saveBlock( name, _block ).then( function(){
        res.write( JSON.stringify( { status: true, _id: _block._id }, 2, null ) );
        res.end();
      }).catch( function( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'creating block failed.' }, 2, null ) );
        res.end();
      });
    }).catch( function( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.get( '/block/:name/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var name = req.params.name;
  var id = req.params.id;
  if( name ){
    if( id ){
      //var block = getBlock( name, id );
      getBlock( name, id ).then( function( block ){
        res.write( JSON.stringify( { status: true, block: block }, 2, null ) );
        res.end();
      }).catch( function( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
        res.end();
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'parameter id is missing to execute this API.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.get( '/blocks/:name', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var name = req.params.name;
  if( name ){
    //var blocks = getBlocks( name );
    getBlocks( name ).then( function( blocks ){
      res.write( JSON.stringify( { status: true, blocks: blocks }, 2, null ) );
      res.end();
    }).catch( function( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.post( '/validate', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var _block = req.body;
  if( _block && _block['_id'] ){
    var _id = _block['_id'];
    var _prev_id = _block['_prev_id'];
    delete _block['_id'];

    var hash = crypto.createHash( 'sha512' );
    hash.update( JSON.stringify( _block ) );
    var new_id = hash.digest( 'hex' );

    if( _id == new_id ){
      if( settings.zerodigit > 0 && countTopZero( new_id ) < settings.zerodigit ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'hash id of your posted data does not meet zeroditit criteria.' }, 2, null ) );
        res.end();
      }else{
        res.write( JSON.stringify( { status: true } ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'hash id of your posted data is "' + new_id + '", and different from original one: "' + _id + '"' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.post( '/encrypt', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( req.body && req.body.body ){
    var key = ( req.body.key ? req.body.key : settings.superSecret );
    var body = JSON.parse( JSON.stringify( req.body.body ) );
    //var encbody = jwt.sign( body, key, {} );
    hc_encrypt( body, key ).then( function( encbody ){
      res.write( JSON.stringify( { status: true, body: encbody }, 2, null ) );
      res.end();
    }).catch( function( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'no body found in request body.' }, 2, null ) );
    res.end();
  }
});

app.post( '/decrypt', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( req.body && req.body.body ){
    var key = ( req.body.key ? req.body.key : settings.superSecret );
    var body = req.body.body;

    hc_decrypt( body, key ).then( function( decbody ){
      res.write( JSON.stringify( { status: true, body: decbody }, 2, null ) );
      res.end();
    }).catch( function( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'no body found in request body.' }, 2, null ) );
    res.end();
  }
});

app.get( '/sync', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var name = req.query.name;
  if( name ){
    var url = settings.master_url + 'blocks/' + name;
    request( url, ( err0, res0, body0 ) => {
      if( err0 ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: err0 }, 2, null ) );
        res.end();
      }else{
        var result = JSON.parse( body0 );
        if( result.status ){
          //. 現在のブロックを全削除
          var db_dir = settings.dbs_folder + '/' + name;
          if( fs.existsSync( db_dir ) ){
            var files = fs.readdirSync( db_dir );
            for( var file in files ){
              fs.unlinkSync( db_dir + '/' + files[file] );
            }
          }
          //. 改めてブロック生成
          var blocks = result.blocks;
          blocks.forEach( function( block ){
            var dir = settings.dbs_folder + '/' + name + '/' + block._id;
            if( !fs.existsSync( dir ) ){
              saveBlock( name, block );
            }
          });
          res.write( JSON.stringify( { status: true }, 2, null ) );
          res.end();
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, error: result.message }, 2, null ) );
          res.end();
        }
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});

app.get( '/reorg', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  res.status( 400 );
  res.write( JSON.stringify( { status: false, message: 'not implemented yet.' }, 2, null ) );
  res.end();

  var name = req.params.name;
  if( name ){
    var blocks = getBlocks( name );
    getBlocks( name ).then( function( blocks ){
      //. 競合ブロックを探す
      var conflict = false;
      var prev_blocks = {};
      var conflict_prev_ids = [];
      blocks.forEach( function( block ){
        var _id = block['_id'];
        var _prev_id = block['_prev_id'];
        var _timestamp = block['_timestamp'];
        var prev_block = JSON.parse(JSON.stringify(block));
        if( _prev_id == null ){ _prev_id = '0'; }
        if( !prev_blocks[_prev_id] ){
          prev_blocks[_prev_id] = [ prev_block ];
        }else{
          //. conclict!
          conflict_prev_ids.push( _prev_id );
          prev_blocks[_prev_id].push( prev_block );
        }
      });

      if( conflict_prev_hashes && conflict_prev_hashes.length > 0 ){
        //. 競合ブロック発見！
        conflict_prev_ids.forEach( function( _prev_id ){
          var conflict_blocks = prev_blocks[_prev_id];

          //. 競合ブロック内で最大の timestamp を探す
          var max_timestamp = 0;
          conflict_blocks.forEach( function( block ){
            if( max_timestamp < block._timestamp ){
              max_timestamp = block._timestamp;
            }
          });

          if( max_timestamp > 0 ){
            console.log( 'max_timestamp=' + max_timestamp );
            //. チェーンから外すブロックを処理
            conflict_blocks.forEach( function( block ){
              if( block._timestamp < max_timestamp ){
                //. このブロックと、このブロックの子孫をすべて処理
                reorgTree( name, block, prev_blocks );  //. await が使えない。。
              }
            });
          }
        });

        var result = { status: true, result: "Conflicts processing.." };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }else{
        //. 競合ブロックなし
        var result = { status: true, result: "No conflict found." };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }
    }).catch( function( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: '' + err }, 2, null ) );
      res.end();
    });

  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'parameter name is missing to execute this API.' }, 2, null ) );
    res.end();
  }
});


app.get( '/js/hashchaindb.js', function( req, res ){
  res.contentType( 'application/javascript; charset=utf-8' );

  var name = req.query.name;

  var js = "console.log( 'This feature is not implemented yet.' );";
  if( name ){
    js = "\n"
    + "var dbname = '" + name + "';\n"
    + "\n"
    + "function createDb(){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'POST',\n"
    + "      url: '/db/' + dbname,\n"
    + "      success: function( result ){\n"
    + "        resolve( result );\n"
    + "      },\n"
    + "      error: function( e ){\n"
    + "        resolve( null );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function getBlocks(){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'GET',\n"
    + "      url: '/blocks/' + dbname,\n"
    + "      success: function( blocks ){\n"
    + "        resolve( blocks );\n"
    + "      },\n"
    + "      error: function( e ){\n"
    + "        reject( e );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function postBody( body ){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'POST',\n"
    + "      url: '/block/' + dbname,\n"
    + "      data: body,\n"
    + "      success: function( result ){\n"
    + "        resolve( result );\n"
    + "      },\n"
    + "      error: function( e ){\n"
    + "        reject( e );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function encryptBody( body, key ){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'POST',\n"
    + "      url: '/encrypt',\n"
    + "      data: { key: key, body: body },\n"
    + "      success: function( result ){\n"
    + "        resolve( result );\n"
    + "      },\n"
    + "      error: function( e0, e1, e2 ){\n"
    + "        reject( e1 );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function decryptBody( body, key ){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'POST',\n"
    + "      url: '/decrypt',\n"
    + "      data: { key: key, body: body },\n"
    + "      success: function( result ){\n"
    + "        resolve( result );\n"
    + "      },\n"
    + "      error: function( e0, e1, e2 ){\n"
    + "        reject( e1 );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function validate( block ){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'POST',\n"
    + "      url: '/validate',\n"
    + "      data: block,\n"
    + "      success: function( result ){\n"
    + "        resolve( result );\n"
    + "      },\n"
    + "      error: function( e ){\n"
    + "        reject( e );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function getLedger(){\n"
    + "  return new Promise( ( resolve, reject ) => {\n"
    + "    $.ajax({\n"
    + "      type: 'GET',\n"
    + "      url: '/blocks/' + dbname,\n"
    + "      success: function( result ){\n"
    + "        var ledger = [];\n"
    + "        var last_prev_id = null;\n"
    + "        while( ledger.length < result.blocks.length ){\n"
    + "          var b = false;\n"
    + "          for( var i = 0; i < result.blocks.length && !b; i ++ ){\n"
    + "            if( result.blocks[i]._prev_id == last_prev_id ){\n"
    + "              last_prev_id = result.blocks[i]._id;\n"
    + "              ledger.push( result.blocks[i] );\n"
    + "              b = true;\n"
    + "            }\n"
    + "          }\n"
    + "        }\n"
    + "        resolve( ledger );\n"
    + "      },\n"
    + "      error: function( e ){\n"
    + "        reject( e );\n"
    + "      }\n"
    + "    });\n"
    + "  });\n"
    + "}\n"
    + "\n"
    + "function str4display( str, len ){\n"
    + "  if( !len ){ len = 10; }\n"
    + "  var s = '';\n"
    + "  if( str ){\n"
    + "    var l = str.length;\n"
    + "    str = str.split( '\"' ).join( '&quot;' );\n"
    + "    s = '<a href=\"#\" title=\"' + str + '\">';\n"
    + "    if( l > len ){\n"
    + "      s += ( str.substr( 0, len ) + '..</a>' );\n"
    + "    }else{\n"
    + "      s += ( str + '</a>' );\n"
    + "    }\n"
    + "  }else{\n"
    + "    s = '&nbsp;';\n"
    + "  }\n"
    + "\n"
    + "  return s;\n"
    + "}\n"
    + "\n"
    + "function timestamp2datetime( ts ){\n"
    + "  var dt = new Date( ts );\n"
    + "  var yyyy = dt.getFullYear();\n"
    + "  var mm = dt.getMonth() + 1;\n"
    + "  var dd = dt.getDate();\n"
    + "  var hh = dt.getHours();\n"
    + "  var nn = dt.getMinutes();\n"
    + "  var ss = dt.getSeconds();\n"
    + "  var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd\n"
    + "    + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;\n"
    + "  return datetime;\n"
    + "}\n"
    + "\n";
  }

  res.write( js );
  res.end();
});


function compareByTimestamp( a, b ){
  var r = 0;

  if( a['_timestamp'] < b['_timestamp'] ){ r = -1; }
  else if( a['_timestamp'] > b['_timestamp'] ){ r = 1; }

  return r;
}

function compareByTimestampRev( a, b ){
  var r = 0;

  if( a['_timestamp'] < b['_timestamp'] ){ r = 1; }
  else if( a['_timestamp'] > b['_timestamp'] ){ r = -1; }

  return r;
}

function countTopZero( str ){
  var cnt = 0;

  while( str.length <= cnt || str.charAt( cnt ) == '0' ){
    cnt ++;
  }

  return cnt;
}

async function hc_encrypt( body, key ){
  return await async_encrypt( body, key );
}
function async_encrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings.superSecret; }
    var encbody = jwt.sign( body, key, {} );  //. body は string or object

    resolve( encbody );
  });
}

async function hc_decrypt( body, key ){
  return await async_decrypt( body, key );
}
function async_decrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings.superSecret; }

    jwt.verify( body, key, function( err, decbody ){
      if( err ){
        reject( err );
      }else{
        if( typeof decbody == 'object' && decbody['iat'] ){ delete decbody['iat']; }
        resolve( decbody );
      }
    });
  });
}

async function getLastBlock( name ){
  var block = null;
  if( name ){
    var blocks = await getBlocks( name );
    if( blocks.length > 0 ){
      blocks.sort( compareByTimestampRev );
      block = blocks[0];
    }
  }else{
  }

  return block;
}

async function getBlocks( name ){
  var blocks = null
  if( name ){
    blocks = [];
    var db_dir = settings.dbs_folder + '/' + name;
    var files = fs.readdirSync( db_dir );
    for( var file in files ){
      var json = fs.readFileSync( db_dir + '/' + files[file], 'utf-8' );
      var decbody = await hc_decrypt( json );
      if( typeof decbody == 'string' ){ decbody = JSON.parse( decbody ); }
      blocks.push( decbody );
    }
  }else{
  }

  return blocks;
}

async function saveBlock( name, block ){
  var r = false;
  var db_dir = settings.dbs_folder + '/' + name;
  if( fs.existsSync( db_dir ) ){
    var json = JSON.stringify( block, null, 2 );
    var encbody = await hc_encrypt( json );
    fs.writeFileSync( db_dir + '/' + block._id, encbody, 'utf-8' );
    r = true;
  }else{
  }

  return r;
}

async function deleteBlock( name, _id ){
  var r = false;
  var db_dir = settings.dbs_folder + '/' + name;
  if( fs.existsSync( db_dir ) ){
    var block_dir = db_dir + '/' + _id;
    if( fs.existsSync( block_dir ) ){
      fs.unlinkSync( block_dir );
      r = true;
    }
  }

  return r;
}

async function getBlock( name, id ){
  var block = null;
  if( name ){
    var blocks = await getBlocks( name );
    var b = false;
    for( var i = 0; i < blocks.length && !b; i ++ ){
      if( blocks[i]._id == id ){
        block = JSON.parse( JSON.stringify( blocks[i] ) );
        b = true;
      }
    }
  }else{
  }

  return block;
}

async function reorgTree( name, pblock, prev_blocks ){
  //. 該当ブロックをリオルグ
  var _id = pblock._id;
  await reorgBlock( name, pblock );

  //. 該当ブロックの子孫が存在していたらリオルグ
  var blocks = prev_blocks[_id];
  if( blocks ){
    blocks.forEach( function( block ){
      reorgTree( name, block, prev_blocks );
    });
  }
}

async function reorgBlock( name, block ){
  console.log( "reorg block: " + block._id );
  console.log( block );
  var _id = block['_id'];
  delete block['_id'];

  //. 自分以外で最後に追加されたブロックを特定する
  var blocks = await getBlocks( name );
  var prev_block = null;
  if( blocks.length > 0 ){
    blocks.sort( compareByTimestampRev );
    prev_block = blocks[0];
    if( prev_block._id == _id ){ prev_block = blocks[1]; }
  }

  if( prev_block && prev_block._id ){
    //. 特定したブロックの次につなぎ直す
    block._timestamp = ( new Date() ).getTime();
    block._prev_id = prev_block._id;

    var nonce = 0;
    var nonce_hash = null;
    do{
      nonce ++;
      block._nonce = nonce;

      var hash = crypto.createHash( 'sha512' );
      hash.update( JSON.stringify( block ) );
      nonce_hash = hash.digest( 'hex' );
    }while( settings.zerodigit > 0 && countTopZero( nonce_hash ) < settings.zerodigit )

    block._id = nonce_hash;

    //. 古いブロックを消してから新しいブロックを保存する
    if( await deleteBlock( name, _id ) ){
      await saveBlock( name, block );
    }
  }
}


var port = process.env.port || 3000;
app.listen( port );
console.log( 'server started on ' + port );
