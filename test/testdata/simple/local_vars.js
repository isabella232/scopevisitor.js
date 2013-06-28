var a/*DECLID:a,local*/ = /*DEF*/7/*DEF:{path:'a',local:true}*/;

a /*REF:a,local*/

a /*REF:a,local*/ = 7;

var b/*DECLID:b,local*/ = {

  c/*DECLID:c,local*/: /*DEF*/7/*DEF:{path:'c',local:true}*/,
};

b/*REF:b,local*/.c = 9;
