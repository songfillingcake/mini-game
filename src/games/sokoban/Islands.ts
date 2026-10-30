const originals = [
  { name: '第一推', rows: ['#######', '#     #', '# @$ .#', '#     #', '#######'] },
  { name: '双星并行', rows: ['########', '# .  . #', '# $  $ #', '#  @   #', '#      #', '########'] },
  { name: '交错小径', rows: ['########', '#  .   #', '#  $   #', '# $@ . #', '#      #', '########'] },
  { name: '绕过石墙', rows: ['########', '# .    #', '# $ #  #', '#   #. #', '#  $   #', '#  @   #', '########'] },
  { name: '借道前行', rows: ['########', '# .  . #', '# #  # #', '# $  $ #', '#  @   #', '#      #', '########'] },
];
// Five original layouts plus their reflected versions. Not ten independent maps.
export const boxIslands = [...originals, ...originals.map(island => ({ name: island.name + ' · 镜像', rows: island.rows.map(row => [...row].reverse().join('')) }))];
