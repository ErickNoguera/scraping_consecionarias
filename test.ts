console.log("✅ TypeScript está funcionando");
console.log("Args:", process.argv);
console.log("import.meta.url:", import.meta.url);
console.log("Comparación:", import.meta.url === `file://${process.argv[1]}`);