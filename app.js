// app.js
var express = require( 'express' );
var fs = require( 'fs' );
var bodyParser = require( 'body-parser' );
var crypto = require( 'crypto' );
var jwt = require( 'jsonwebtoken' );
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
    var _prev_block = getLastBlock( name );
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

    if( saveBlock( name, _block ) ){
      res.write( JSON.stringify( { status: true, _id: _block._id }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'creating block failed.' }, 2, null ) );
      res.end();
    }
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
      var block = getBlock( name, id );
      res.write( JSON.stringify( { status: true, block: block }, 2, null ) );
      res.end();
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
    var blocks = getBlocks( name );
    res.write( JSON.stringify( { status: true, blocks: blocks }, 2, null ) );
    res.end();
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
  if( req.body && req.body.body && req.body.key ){
    var key = req.body.key;
    var body = JSON.parse( JSON.stringify( req.body.body ) );
    var encbody = jwt.sign( body, key, {} );

    res.write( JSON.stringify( { status: true, body: encbody }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'no body/key found in request body.' }, 2, null ) );
    res.end();
  }
});

app.post( '/decrypt', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( req.body && req.body.body && req.body.key ){
    var key = req.body.key;
    var body = req.body.body;

    jwt.verify( body, key, function( err, decrypted ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'Invalid signature' }, 2, null ) );
        res.end();
      }else{
        if( decrypted['iat'] ){ delete decrypted['iat']; }
        res.write( JSON.stringify( { status: true, body: decrypted }, 2, null ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'no body/key found in request body.' }, 2, null ) );
    res.end();
  }
});

app.get( '/reorg', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  res.status( 400 );
  res.write( JSON.stringify( { status: false, message: 'not implemented yet.' }, 2, null ) );
  res.end();
  /*
  if( db ){
    db.view( 'library', 'bytimestamp', {}, function( err, body ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        //. 競合ノードを探す
        var conflict = false;
        var prev_docs = {};
        var conflict_prev_hashes = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.value));
          var _id = _doc['_id'];
          var _hash = _doc['hashchainsolo_system']['hash'];
          var _prev_hash = _doc['hashchainsolo_system']['prev_hash'];
          var _timestamp = _doc['hashchainsolo_system']['timestamp'];
          //var prev_doc = { id: _id, hash: _hash, timestamp: _timestamp };
          var prev_doc = _doc;
          if( _prev_hash == null ){ _prev_hash = '0'; }
          if( !prev_docs[_prev_hash] ){
            prev_docs[_prev_hash] = [ prev_doc ];
          }else{
            //. conclict!
            conflict_prev_hashes.push( _prev_hash );
            //prev_docs[_prev_hash].push( [ prev_doc ] );
            prev_docs[_prev_hash].push( prev_doc );
          }
        });

        if( conflict_prev_hashes && conflict_prev_hashes.length > 0 ){
          //. 競合ノード発見！
          conflict_prev_hashes.forEach( function( prev_hash ){
            var conflict_docs = prev_docs[prev_hash];

            //. 最大の timestamp を探す
            var max_timestamp = 0;
            conflict_docs.forEach( function( doc ){
              if( max_timestamp < doc.hashchainsolo_system.timestamp ){
                max_timestamp = doc.hashchainsolo_system.timestamp;
              }
            });

            if( max_timestamp > 0 ){
              console.log( 'max_timestamp=' + max_timestamp );
              //. チェーンから外すブロックを処理
              conflict_docs.forEach( function( doc ){
                console.log( doc );
                if( doc.hashchainsolo_system.timestamp < max_timestamp ){
                  //. このノードと、このノードの子孫をすべて処理

                  //. 「処理」をどうする？　削除？prev_hashのみ処理済みのものに書き換える？
                  //deleteTree( doc, prev_docs );
                  reorgTree( doc, prev_docs );
                }
              });
            }
          });

          var result = { status: true, result: "Conflicts processing.." };
          res.write( JSON.stringify( result, 2, null ) );
          res.end();
        }else{
          //. 競合ノードなし
          var result = { status: true, result: "No conflict found." };
          res.write( JSON.stringify( result, 2, null ) );
          res.end();
        }
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'hashchainsolo is failed to initialize.' }, 2, null ) );
    res.end();
  }
  */
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
    + "      error: function( e ){\n"
    + "        reject( e );\n"
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
    + "      error: function( e ){\n"
    + "        reject( e );\n"
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

function validateDocument( doc ){
  var r = true;

  if( typeof doc !== 'object' ){
    r = false;
  }else{
    /*
    if( 'id' in doc ){
      r = false;
    }
    if( 'rev' in doc ){
      r = false;
    }
    */
    if( 'hashchainsolo_system' in doc ){
      r = false;
    }
  }

  return r;
}

function getLastBlock( name ){
  var block = null;
  if( name ){
    var blocks = getBlocks( name );
    if( blocks.length > 0 ){
      blocks.sort( compareByTimestampRev );
      block = blocks[0];
    }
  }else{
  }

  return block;
}

function getBlocks( name ){
  var blocks = null
  if( name ){
    blocks = [];
    var db_dir = settings.dbs_folder + '/' + name;
    var files = fs.readdirSync( db_dir );
    for( var file in files ){
      var json = fs.readFileSync( db_dir + '/' + files[file], 'utf-8' );
      blocks.push( JSON.parse( json ) );
    }
  }else{
  }

  return blocks;
}

function saveBlock( name, block ){
  var r = false;
  var db_dir = settings.dbs_folder + '/' + name;
  if( fs.existsSync( db_dir ) ){
    var json = JSON.stringify( block, null, 2 );
    fs.writeFileSync( db_dir + '/' + block._id, json, 'utf-8' );
    r = true;
  }

  return r;
}

function getBlock( name, id ){
  var block = null;
  if( name ){
    var blocks = getBlocks( name );
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


var port = process.env.port || 3000;
app.listen( port );
console.log( 'server started on ' + port );