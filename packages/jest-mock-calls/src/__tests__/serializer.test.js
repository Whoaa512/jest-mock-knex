describe('serializer', () => {
  it('successful snapshot string', async () => {
    const mock = jest.fn();
    mock('AAA', 'BBB');
    mock('AAA', 'CCC');
    expect(mock).toMatchSnapshot();
  });

  it('successful snapshot object', async () => {
    const mock = jest.fn();
    mock(['X', 'Y', 'Z'], { name: 'yutin' });
    mock(['I', 'J'], { name: 'noknok' });
    expect(mock).toMatchSnapshot();
  });
});
