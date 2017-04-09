module.exports={
test:function test(client){
return client&&client.mockName==='knex';
},
print:function print(client,serializer){
return serializer(client.toJSON());
}};
