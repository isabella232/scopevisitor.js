var /*DECL*/a/*DECLID:'local:a:12'*/ = 7/*DECL:{id:'local:a:'}*/;

a /*REF:'local:a:12'*/

a /*REF:'local:a:12'*/ = 7;

var b/*DECLID:'local:b:'*/ = {

  // TODO(sqs): commented out since we don't support local object field vars
  c/*#DECLID:'local:c:'*/: /*#DECL*/7/*DECL:{id:'local:c:'}*/,
};

b/*REF:'local:b:'*/.c = 9;
