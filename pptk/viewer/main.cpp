#include <QApplication>
#include <QSurfaceFormat>
#include <QDebug>
#include <iostream>
#include "viewer.h"

int main(int argc, char* argv[]) {
  if (argc != 2) {
    qDebug() << "usage: viewer <port number>";
    return 1;
  }

  QSurfaceFormat format;
  format.setDepthBufferSize(24);
  format.setStencilBufferSize(8);
  format.setVersion(2, 1);
  format.setProfile(QSurfaceFormat::CompatibilityProfile);
  format.setSwapInterval(0);
  QSurfaceFormat::setDefaultFormat(format);

  QApplication a(argc, argv);
  unsigned short clientPort = (unsigned short)atoi(argv[1]);
  Viewer viewer(clientPort);
  viewer.resize(512, 512);
  viewer.show();

  return a.exec();
}
