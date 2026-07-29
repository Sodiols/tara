export function img(id: string, width = 900, height = 1125): string {
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&q=80&auto=format`;
}

// Every ID below has been individually downloaded and visually verified to show
// what its key name says (a woman in elegant/appropriate attire, an unbranded bag,
// unbranded jewelry, etc.) — no visible third-party logos or mismatched content.
export const stockImages = {
  heroWoman: "1610030469983-98e550d6193c",
  portraitA: "1490481651871-ab68de25d43d",
  portraitB: "1769031364744-9fecc63d93cd",
  portraitC: "1784139021760-9f8ecb5c5586",
  portraitD: "1483985988355-763728e1935b",
  portraitE: "1515372039744-b8f02a3ae446",
  portraitF: "1642618277064-73c0bd608111",
  portraitG: "1596783074918-c84cb06531ca",
  portraitH: "1566174053879-31528523f8ae",
  portraitI: "1596783074918-c84cb06531ca",
  portraitJ: "1571513722275-4b41940f54b8",
  portraitK: "1642618277064-73c0bd608111",
  bagA: "1657603738389-951c374b740c",
  bagB: "1691480150204-66dd1eb77391",
  bagC: "1705909237050-7a7625b47fac",
  bagD: "1605733513597-a8f8341084e6",
  bagE: "1711548244653-72219aa9ac27",
  fabricA: "1445205170230-053b83016050",
  fabricB: "1441984904996-e0b6ba687e04",
  accessory: "1561828995-aa79a2db86dd",
  bagF: "1657291334522-6c1dfb9e2b35",
  lifestyleA: "1769031364744-9fecc63d93cd",
  lifestyleB: "1566174053879-31528523f8ae",
  lifestyleC: "1784139021760-9f8ecb5c5586",
  lifestyleD: "1566174053879-31528523f8ae",
};
