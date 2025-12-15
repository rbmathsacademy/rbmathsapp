require('dotenv').config({ path: '.env.local' });

console.log('RAW MONGODB_URI from environment:');
console.log(process.env.MONGODB_URI);
console.log('\nLength:', process.env.MONGODB_URI?.length);
console.log('\nHas /portal_app:', process.env.MONGODB_URI?.includes('/portal_app'));
console.log('Has /test:', process.env.MONGODB_URI?.includes('/test'));

// Also print character by character around the .net/ part
const uri = process.env.MONGODB_URI;
const netIndex = uri?.indexOf('.net/');
if (netIndex >= 0) {
    console.log('\nCharacters after .net/:');
    const after = uri.substring(netIndex + 5, netIndex + 20);
    console.log('Text:', JSON.stringify(after));
    console.log('Char codes:', Array.from(after).map(c => c.charCodeAt(0)));
}
